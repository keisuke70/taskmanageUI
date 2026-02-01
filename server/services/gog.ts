import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface GogResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

const GOG_ENV = {
  ...process.env,
  PATH: `${process.env.HOME}/.local/bin:${process.env.PATH}`,
};

// Google API direct access (for operations gog doesn't support)
interface TokenCache {
  accessToken: string;
  expiresAt: number;
}

let tokenCache: TokenCache | null = null;

async function getAccessToken(): Promise<string> {
  // Return cached token if still valid
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60000) {
    return tokenCache.accessToken;
  }

  // Read credentials
  const credentialsPath = path.join(process.env.HOME || '', '.config/gogcli/credentials.json');
  const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf-8'));

  // Export refresh token
  const tokenPath = '/tmp/gog_token_export.json';
  await new Promise<void>((resolve, reject) => {
    const proc = spawn('bash', ['-c', `source ~/.gog_env && gog auth tokens export keith235670@gmail.com --out ${tokenPath} --overwrite`], { env: GOG_ENV });
    proc.on('close', (code) => code === 0 ? resolve() : reject(new Error('Failed to export token')));
    proc.on('error', reject);
  });

  const tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
  const refreshToken = tokenData.refresh_token;

  // Exchange refresh token for access token
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: credentials.client_id,
      client_secret: credentials.client_secret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to get access token');
  }

  const data = await response.json() as { access_token: string; expires_in: number };
  tokenCache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return tokenCache.accessToken;
}

// Default task list ID - will be fetched on first use
let defaultTaskListId: string | null = null;

async function execGog<T>(args: string[]): Promise<GogResult<T>> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    const errorChunks: Buffer[] = [];

    // Source the gog env file first via shell
    const command = `source ~/.gog_env 2>/dev/null; gog ${args.map(a => `"${a.replace(/"/g, '\\"')}"`).join(' ')}`;
    const proc = spawn('bash', ['-c', command], {
      env: GOG_ENV,
    });

    proc.stdout.on('data', (data) => chunks.push(data));
    proc.stderr.on('data', (data) => errorChunks.push(data));

    proc.on('close', (code) => {
      const stdout = Buffer.concat(chunks).toString('utf-8').trim();
      const stderr = Buffer.concat(errorChunks).toString('utf-8').trim();

      if (code !== 0) {
        resolve({ success: false, error: stderr || `gog exited with code ${code}` });
        return;
      }

      try {
        const data = stdout ? JSON.parse(stdout) : null;
        resolve({ success: true, data });
      } catch {
        resolve({ success: false, error: `Failed to parse gog output: ${stdout}` });
      }
    });

    proc.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });
  });
}

// Task Lists
export interface TaskList {
  id: string;
  title: string;
  updated: string;
}

interface TaskListsResponse {
  tasklists: TaskList[];
}

export async function getTaskLists(): Promise<GogResult<TaskList[]>> {
  const result = await execGog<TaskListsResponse>(['tasks', 'lists', '--json']);
  if (result.success && result.data) {
    return { success: true, data: result.data.tasklists || [] };
  }
  return result as GogResult<TaskList[]>;
}

interface CreateTaskListResponse {
  tasklist: TaskList;
}

export async function createTaskList(title: string): Promise<GogResult<TaskList>> {
  const result = await execGog<CreateTaskListResponse>(['tasks', 'lists', 'create', title, '--json']);
  if (result.success && result.data?.tasklist) {
    return { success: true, data: result.data.tasklist };
  }
  return result as GogResult<TaskList>;
}

export async function deleteTaskList(listId: string): Promise<GogResult<void>> {
  try {
    const accessToken = await getAccessToken();
    const response = await fetch(`https://tasks.googleapis.com/tasks/v1/users/@me/lists/${listId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: error || `Failed to delete task list: ${response.status}` };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to delete task list' };
  }
}

async function getDefaultTaskListId(): Promise<string> {
  if (defaultTaskListId) return defaultTaskListId;

  const result = await getTaskLists();
  if (result.success && result.data && result.data.length > 0) {
    defaultTaskListId = result.data[0].id;
    return defaultTaskListId;
  }
  throw new Error('No task lists found');
}

// Tasks
export interface Task {
  id: string;
  title: string;
  notes?: string;
  due?: string;
  completed?: string;
  status: 'needsAction' | 'completed';
  updated: string;
  parent?: string;
  position?: string;
}

interface TasksResponse {
  tasks: Task[];
}

interface SingleTaskResponse {
  task: Task;
}

export async function getTasks(listId?: string): Promise<GogResult<Task[]>> {
  const taskListId = listId || await getDefaultTaskListId();
  const result = await execGog<TasksResponse>(['tasks', 'list', taskListId, '--json']);
  if (result.success && result.data) {
    return { success: true, data: result.data.tasks || [] };
  }
  return result as GogResult<Task[]>;
}

export async function createTask(
  title: string,
  options?: { notes?: string; due?: string; listId?: string }
): Promise<GogResult<Task>> {
  const taskListId = options?.listId || await getDefaultTaskListId();
  const args = ['tasks', 'add', taskListId, '--title', title, '--json'];
  if (options?.notes) args.push('--notes', options.notes);
  if (options?.due) args.push('--due', options.due);
  const result = await execGog<SingleTaskResponse>(args);
  if (result.success && result.data?.task) {
    return { success: true, data: result.data.task };
  }
  return result as GogResult<Task>;
}

export async function updateTask(
  taskId: string,
  updates: Partial<Pick<Task, 'title' | 'notes' | 'due' | 'status'>>,
  listId?: string
): Promise<GogResult<Task>> {
  const taskListId = listId || await getDefaultTaskListId();
  const args = ['tasks', 'update', taskListId, taskId, '--json'];
  if (updates.title) args.push('--title', updates.title);
  if (updates.notes !== undefined) args.push('--notes', updates.notes);
  if (updates.due) args.push('--due', updates.due);
  const result = await execGog<SingleTaskResponse>(args);
  if (result.success && result.data?.task) {
    return { success: true, data: result.data.task };
  }
  return result as GogResult<Task>;
}

export async function completeTask(taskId: string, listId?: string): Promise<GogResult<Task>> {
  const taskListId = listId || await getDefaultTaskListId();
  const result = await execGog<SingleTaskResponse>(['tasks', 'done', taskListId, taskId, '--json']);
  if (result.success && result.data?.task) {
    return { success: true, data: result.data.task };
  }
  return result as GogResult<Task>;
}

export async function uncompleteTask(taskId: string, listId?: string): Promise<GogResult<Task>> {
  const taskListId = listId || await getDefaultTaskListId();
  const result = await execGog<SingleTaskResponse>(['tasks', 'undo', taskListId, taskId, '--json']);
  if (result.success && result.data?.task) {
    return { success: true, data: result.data.task };
  }
  return result as GogResult<Task>;
}

export async function deleteTask(taskId: string, listId?: string): Promise<GogResult<void>> {
  const taskListId = listId || await getDefaultTaskListId();
  // Delete doesn't return JSON, so we use a custom exec that just checks exit code
  return new Promise((resolve) => {
    const command = `source ~/.gog_env 2>/dev/null; gog tasks delete "${taskListId}" "${taskId}" --force`;
    const proc = spawn('bash', ['-c', command], { env: GOG_ENV });

    let stderr = '';
    proc.stderr.on('data', (data) => { stderr += data.toString(); });

    proc.on('close', (code) => {
      if (code !== 0) {
        resolve({ success: false, error: stderr || `gog exited with code ${code}` });
      } else {
        resolve({ success: true });
      }
    });

    proc.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });
  });
}

// Gmail
export interface EmailThread {
  id: string;
  date: string;
  from: string;
  subject: string;
  labels: string[];
  messageCount: number;
}

export interface EmailDetail {
  body: string;
  headers: {
    from: string;
    to: string;
    subject: string;
    date: string;
  };
  message: {
    id: string;
    threadId: string;
    snippet: string;
  };
}

interface EmailSearchResponse {
  threads: EmailThread[];
  nextPageToken?: string;
}

export async function searchEmails(query: string, maxResults = 10): Promise<GogResult<EmailThread[]>> {
  const result = await execGog<EmailSearchResponse>(['gmail', 'search', query, '--json']);
  if (result.success && result.data) {
    const threads = result.data.threads || [];
    return { success: true, data: threads.slice(0, maxResults) };
  }
  return result as GogResult<EmailThread[]>;
}

export async function getEmailDetail(messageId: string): Promise<GogResult<EmailDetail>> {
  const result = await execGog<EmailDetail>(['gmail', 'get', messageId, '--json']);
  return result;
}

// Calendar
export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  location?: string;
  htmlLink?: string;
}

interface CalendarEventsResponse {
  events: CalendarEvent[];
}

export async function getCalendarEvents(
  startDate?: string,
  endDate?: string
): Promise<GogResult<CalendarEvent[]>> {
  const args = ['calendar', 'events', '--json'];
  if (startDate) args.push('--from', startDate);
  if (endDate) args.push('--to', endDate);
  const result = await execGog<CalendarEventsResponse>(args);
  if (result.success && result.data) {
    return { success: true, data: result.data.events || [] };
  }
  return result as GogResult<CalendarEvent[]>;
}

interface CalendarEventResponse {
  event: CalendarEvent;
}

export async function createCalendarEvent(
  title: string,
  start: string,
  end: string,
  calendarId = 'primary'
): Promise<GogResult<CalendarEvent>> {
  const args = [
    'calendar', 'create', calendarId,
    '--summary', title,
    '--from', start,
    '--to', end,
    '--json',
  ];
  const result = await execGog<CalendarEventResponse>(args);
  if (result.success && result.data?.event) {
    return { success: true, data: result.data.event };
  }
  return result as GogResult<CalendarEvent>;
}

export async function updateCalendarEvent(
  eventId: string,
  updates: { start?: string; end?: string; summary?: string },
  calendarId = 'primary'
): Promise<GogResult<CalendarEvent>> {
  const args = ['calendar', 'update', calendarId, eventId, '--json'];
  if (updates.start) args.push('--from', updates.start);
  if (updates.end) args.push('--to', updates.end);
  if (updates.summary) args.push('--summary', updates.summary);
  const result = await execGog<CalendarEventResponse>(args);
  if (result.success && result.data?.event) {
    return { success: true, data: result.data.event };
  }
  return result as GogResult<CalendarEvent>;
}
