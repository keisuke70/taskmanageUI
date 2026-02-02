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

// Load .env file from project root
function loadEnv(): void {
  try {
    const envPath = path.join(import.meta.dirname, '../../.env');
    const content = fs.readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const match = line.match(/^([A-Z_]+)=["']?(.+?)["']?$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2];
      }
    }
  } catch {
    // .env file doesn't exist - that's fine for single account setups
  }
}

loadEnv();

// Account configuration
// GOG_PRIMARY_ACCOUNT: used for write operations (create tasks, events)
// GOG_ACCOUNTS: comma-separated list of accounts to read from
const GOG_PRIMARY_ACCOUNT = process.env.GOG_PRIMARY_ACCOUNT || process.env.GOG_ACCOUNT || '';
const GOG_ACCOUNTS = process.env.GOG_ACCOUNTS
  ? process.env.GOG_ACCOUNTS.split(',').map(a => a.trim())
  : (GOG_PRIMARY_ACCOUNT ? [GOG_PRIMARY_ACCOUNT] : []);
const GOG_CWD = process.env.HOME || '/tmp';

// For backward compatibility
const GOG_ACCOUNT = GOG_PRIMARY_ACCOUNT;

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

  // Export refresh token (requires GOG_ACCOUNT to be set for multiple accounts)
  if (!GOG_ACCOUNT) {
    throw new Error('GOG_ACCOUNT environment variable required for this operation with multiple accounts');
  }
  const tokenPath = '/tmp/gog_token_export.json';
  await new Promise<void>((resolve, reject) => {
    const proc = spawn('bash', ['-c', `source ~/.gog_env && gog auth tokens export ${GOG_ACCOUNT} --out ${tokenPath} --overwrite`], { env: GOG_ENV, cwd: GOG_CWD });
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

// Execute gog command with optional specific account
async function execGogWithAccount<T>(args: string[], account?: string): Promise<GogResult<T>> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    const errorChunks: Buffer[] = [];

    // Use specified account, or fall back to primary account
    const targetAccount = account || GOG_PRIMARY_ACCOUNT;
    const allArgs = targetAccount ? [...args, '--account', targetAccount] : args;
    const command = `source ~/.gog_env 2>/dev/null; gog ${allArgs.map(a => `"${a.replace(/"/g, '\\"')}"`).join(' ')}`;
    const proc = spawn('bash', ['-c', command], {
      env: GOG_ENV,
      cwd: GOG_CWD,
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

// Default execGog uses primary account (for backward compatibility)
async function execGog<T>(args: string[]): Promise<GogResult<T>> {
  return execGogWithAccount<T>(args, GOG_PRIMARY_ACCOUNT);
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
    const accountFlag = GOG_ACCOUNT ? ` --account "${GOG_ACCOUNT}"` : '';
    const command = `source ~/.gog_env 2>/dev/null; gog tasks delete "${taskListId}" "${taskId}" --force${accountFlag}`;
    const proc = spawn('bash', ['-c', command], { env: GOG_ENV, cwd: GOG_CWD });

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
  account?: string; // Which account this email belongs to
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
  account?: string;
}

interface EmailSearchResponse {
  threads: EmailThread[];
  nextPageToken?: string;
}

// Search emails from a single account
export async function searchEmails(query: string, maxResults = 10, account?: string): Promise<GogResult<EmailThread[]>> {
  const result = await execGogWithAccount<EmailSearchResponse>(['gmail', 'search', query, '--json'], account);
  if (result.success && result.data) {
    const threads = (result.data.threads || []).slice(0, maxResults).map(t => ({ ...t, account }));
    return { success: true, data: threads };
  }
  return result as GogResult<EmailThread[]>;
}

// Search emails from ALL configured accounts
export async function searchEmailsAllAccounts(query: string, maxResults = 10): Promise<GogResult<EmailThread[]>> {
  if (GOG_ACCOUNTS.length === 0) {
    return { success: false, error: 'No accounts configured' };
  }

  const results = await Promise.all(
    GOG_ACCOUNTS.map(account => searchEmails(query, maxResults, account))
  );

  const allThreads: EmailThread[] = [];
  const errors: string[] = [];

  for (const result of results) {
    if (result.success && result.data) {
      allThreads.push(...result.data);
    } else if (result.error) {
      errors.push(result.error);
    }
  }

  // Sort by date (newest first)
  allThreads.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Limit total results
  const limited = allThreads.slice(0, maxResults);

  if (limited.length === 0 && errors.length > 0) {
    return { success: false, error: errors.join('; ') };
  }

  return { success: true, data: limited };
}

export async function getEmailDetail(messageId: string, account?: string): Promise<GogResult<EmailDetail>> {
  const result = await execGogWithAccount<EmailDetail>(['gmail', 'get', messageId, '--json'], account);
  if (result.success && result.data) {
    return { success: true, data: { ...result.data, account } };
  }
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
  account?: string; // Which account this event belongs to
}

interface CalendarEventsResponse {
  events: CalendarEvent[];
}

// Get calendar events from a single account
export async function getCalendarEvents(
  startDate?: string,
  endDate?: string,
  account?: string
): Promise<GogResult<CalendarEvent[]>> {
  const args = ['calendar', 'events', '--json'];
  if (startDate) args.push('--from', startDate);
  if (endDate) args.push('--to', endDate);
  const result = await execGogWithAccount<CalendarEventsResponse>(args, account);
  if (result.success && result.data) {
    const events = (result.data.events || []).map(e => ({ ...e, account }));
    return { success: true, data: events };
  }
  return result as GogResult<CalendarEvent[]>;
}

// Get calendar events from ALL configured accounts
export async function getCalendarEventsAllAccounts(
  startDate?: string,
  endDate?: string
): Promise<GogResult<CalendarEvent[]>> {
  if (GOG_ACCOUNTS.length === 0) {
    return { success: false, error: 'No accounts configured' };
  }

  const results = await Promise.all(
    GOG_ACCOUNTS.map(account => getCalendarEvents(startDate, endDate, account))
  );

  const allEvents: CalendarEvent[] = [];
  const errors: string[] = [];

  for (const result of results) {
    if (result.success && result.data) {
      allEvents.push(...result.data);
    } else if (result.error) {
      errors.push(result.error);
    }
  }

  // Sort by start time
  allEvents.sort((a, b) => {
    const aTime = a.start.dateTime || a.start.date || '';
    const bTime = b.start.dateTime || b.start.date || '';
    return aTime.localeCompare(bTime);
  });

  if (allEvents.length === 0 && errors.length > 0) {
    return { success: false, error: errors.join('; ') };
  }

  return { success: true, data: allEvents };
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
