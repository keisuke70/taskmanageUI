import { execSync } from 'child_process';
import { searchEmailsAllAccounts, getEmailDetail, getCalendarEventsAllAccounts } from './gog';

export interface Suggestion {
  id: string;
  source: 'gmail' | 'calendar';
  title: string;
  due?: string;
  notes?: string;
  sourceId: string;
  sourceTitle: string;
  sourceFrom?: string;
  sourceDate?: string;
  sourceSnippet?: string;
}

interface ClaudeSuggestionResponse {
  suggestions: Array<{
    title: string;
    due?: string;
    notes?: string;
  }>;
}

// Get local date as YYYY-MM-DD
function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

async function analyzeWithClaude(
  prompt: string,
  clientLocalDate?: string
): Promise<ClaudeSuggestionResponse> {
  const today = clientLocalDate || toLocalDateString(new Date());

  const fullPrompt = `${prompt}

今日: ${today}

以下のJSON形式のみを出力（他の文字は不要）:
{"suggestions":[{"title":"タスク名","due":"YYYY-MM-DD or null","notes":"メモ(optional)"}]}

タスクがなければ {"suggestions":[]} を返す。`;

  try {
    const escapedPrompt = fullPrompt.replace(/'/g, "'\\''" );

    const output = execSync(
      `claude -p '${escapedPrompt}' --output-format text`,
      {
        encoding: 'utf-8',
        timeout: 60000,
        maxBuffer: 1024 * 1024,
        env: { ...process.env, HOME: process.env.HOME },
      }
    );

    const jsonMatch = output.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return { suggestions: [] };
  } catch (err) {
    console.error('Claude CLI error:', err);
    return { suggestions: [] };
  }
}

export async function analyzeEmails(clientLocalDate?: string): Promise<Suggestion[]> {
  // Search for recent unread emails from ALL accounts (excluding promotions)
  const searchResult = await searchEmailsAllAccounts('is:unread -category:promotions newer_than:2d', 10);

  if (!searchResult.success || !searchResult.data || searchResult.data.length === 0) {
    return [];
  }

  const emails = searchResult.data;
  const suggestions: Suggestion[] = [];

  // Process emails in batches to avoid overwhelming Claude
  for (const email of emails.slice(0, 5)) {
    // Get email detail for better context (pass account for correct lookup)
    const detailResult = await getEmailDetail(email.id, email.account);
    const snippet = detailResult.success && detailResult.data?.message?.snippet
      ? detailResult.data.message.snippet
      : '';
    const body = detailResult.success && detailResult.data?.body
      ? detailResult.data.body.substring(0, 500)
      : '';

    const prompt = `このメールからタスクを抽出してください。返信が必要、対応が必要、期限があるものを探す。

From: ${email.from}
Subject: ${email.subject}
Date: ${email.date}
Account: ${email.account || 'unknown'}
Content: ${snippet || body}

関係ないメール（広告、通知のみ）の場合はタスクなしで返す。`;

    const result = await analyzeWithClaude(prompt, clientLocalDate);

    for (const s of result.suggestions) {
      suggestions.push({
        id: `gmail-${email.id}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        source: 'gmail',
        title: s.title,
        due: s.due || undefined,
        notes: s.notes || undefined,
        sourceId: email.id,
        sourceTitle: email.subject,
        sourceFrom: email.from,
        sourceDate: email.date,
        sourceSnippet: snippet || body.substring(0, 200),
      });
    }
  }

  return suggestions;
}

export async function analyzeCalendar(clientLocalDate?: string): Promise<Suggestion[]> {
  const today = clientLocalDate || toLocalDateString(new Date());

  // Get events for next 7 days from ALL accounts
  const endDate = new Date(today + 'T12:00:00');
  endDate.setDate(endDate.getDate() + 7);
  const endDateStr = toLocalDateString(endDate);

  const eventsResult = await getCalendarEventsAllAccounts(today, endDateStr);

  if (!eventsResult.success || !eventsResult.data || eventsResult.data.length === 0) {
    return [];
  }

  const events = eventsResult.data;
  const suggestions: Suggestion[] = [];

  for (const event of events.slice(0, 5)) {
    const eventDate = event.start.dateTime || event.start.date || '';
    const eventDateStr = eventDate.split('T')[0];

    const prompt = `このカレンダーイベントに関連する準備タスクを1つだけ提案してください。

イベント: ${event.summary}
日時: ${eventDate}
場所: ${event.location || 'なし'}
説明: ${event.description?.substring(0, 300) || 'なし'}

ルール:
- 提案は最大1つのみ（複数提案は禁止）
- 最も重要な準備タスクを1つ選んで提案
- 例:「〇〇会議の資料・議題を確認する」のような包括的なタスク
- 準備不要（単なる通知、終日イベント等）の場合はタスクなしで返す`;

    const result = await analyzeWithClaude(prompt, clientLocalDate);

    for (const s of result.suggestions) {
      // Set due date to the day before event if not specified
      let due = s.due;
      if (!due && eventDateStr > today) {
        const dayBefore = new Date(eventDateStr + 'T12:00:00');
        dayBefore.setDate(dayBefore.getDate() - 1);
        due = toLocalDateString(dayBefore);
      }

      suggestions.push({
        id: `cal-${event.id}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        source: 'calendar',
        title: s.title,
        due: due || undefined,
        notes: s.notes || undefined,
        sourceId: event.id,
        sourceTitle: event.summary,
        sourceDate: eventDateStr,
        sourceSnippet: event.description?.substring(0, 200),
      });
    }
  }

  return suggestions;
}

export async function analyzeBoth(clientLocalDate?: string): Promise<{
  gmail: Suggestion[];
  calendar: Suggestion[];
}> {
  const [gmail, calendar] = await Promise.all([
    analyzeEmails(clientLocalDate),
    analyzeCalendar(clientLocalDate),
  ]);

  return { gmail, calendar };
}
