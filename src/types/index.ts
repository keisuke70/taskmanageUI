export interface Task {
  id: string;
  title: string;
  notes?: string;
  due?: string;
  completed?: string; // ISO timestamp when completed
  status: 'needsAction' | 'completed';
  updated: string;
  parent?: string;
  position?: string;
  links?: { type: string; description: string; link: string }[];
}

export interface TaskList {
  id: string;
  title: string;
  updated: string;
}

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: {
    dateTime?: string;
    date?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
  };
  location?: string;
  htmlLink?: string;
}

export interface AiMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export type CalendarViewMode = 'day' | 'week';

// Suggestions
export type SuggestionSource = 'gmail' | 'calendar';

export interface Suggestion {
  id: string;
  source: SuggestionSource;
  title: string;
  due?: string;
  notes?: string;
  // Source context
  sourceId: string;  // email thread ID or event ID
  sourceTitle: string;  // email subject or event summary
  sourceFrom?: string;  // email sender
  sourceDate?: string;  // email date or event date
  sourceSnippet?: string;  // email snippet or event description
}

// Multi-list support
export interface ListVisibility {
  [listId: string]: boolean;
}

export interface ListCollapsed {
  [listId: string]: boolean;
}

export interface TasksByList {
  [listId: string]: Task[];
}
