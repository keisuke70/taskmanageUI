import { execSync } from 'child_process';

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

interface ClaudeResponse {
  response: string;
  tasks: ExtractedTask[];
}

export interface ExistingTask {
  id: string;
  title: string;
  due?: string;
  notes?: string;
  listId: string;
}

// Get local date as YYYY-MM-DD
function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Use Claude Code CLI for intelligent task extraction
export async function extractTasksWithClaude(
  userMessage: string,
  _conversationContext?: string,
  clientLocalDate?: string,  // YYYY-MM-DD from browser
  existingTasks?: ExistingTask[]  // 既存タスク一覧
): Promise<ClaudeResponse> {
  // Use client's local date if provided, otherwise fall back to server date
  const today = clientLocalDate || toLocalDateString(new Date());

  // Calculate tomorrow from today string
  const todayDate = new Date(today + 'T12:00:00');  // noon to avoid timezone issues
  const tomorrowDate = new Date(todayDate);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = toLocalDateString(tomorrowDate);

  // Calculate next Friday from today
  const fridayDate = new Date(todayDate);
  const day = fridayDate.getDay();
  const daysUntilFriday = (5 - day + 7) % 7 || 7;
  fridayDate.setDate(fridayDate.getDate() + daysUntilFriday);
  const friday = toLocalDateString(fridayDate);

  // 既存タスク一覧を文字列化
  const existingTasksStr = existingTasks && existingTasks.length > 0
    ? existingTasks.map(t => `- id:${t.id} "${t.title}"${t.due ? ` (期限:${t.due})` : ''}`).join('\n')
    : '(なし)';

  const prompt = `あなたはタスク管理アシスタントです。ユーザーの発言に応じて、適切に応答してください。

【現在の日付】
今日: ${today}
明日: ${tomorrow}
今週金曜: ${friday}

【既存タスク一覧】
${existingTasksStr}

【ユーザーの発言】
"${userMessage}"

【対応可能なアクション】
1. add: 新しいタスクを追加
2. update: 既存タスクの期限やメモを変更
3. delete: 既存タスクを削除
4. complete: 既存タスクを完了にする
5. uncomplete: 完了したタスクを未完了に戻す
6. (アクションなし): 普通の会話、質問への回答、タスク一覧の説明など

【判断ルール】
- 「〇〇を追加」「〇〇やる」「〇〇しなきゃ」→ action: "add"
- 「〇〇の期限を変更」「〇〇を明日までに」→ action: "update"（既存タスクを部分一致で特定）
- 「〇〇を削除」「〇〇をやめる」「〇〇いらない」「〇〇を消して」→ action: "delete"
- 「〇〇を完了」「〇〇終わった」「〇〇できた」「〇〇を完了にして」「〇〇done」→ action: "complete"
- 「〇〇をやっぱりまだ」「〇〇を未完了に」→ action: "uncomplete"
- 挨拶、質問、雑談、タスクの確認など→ アクションなしで会話で応答（tasksは空配列）

【重要：アクション判定】
- "完了"という言葉が含まれたら action は必ず "complete"
- "削除"や"消して"が含まれたら action は必ず "delete"
- updateは期限やメモの変更のみ

【出力形式】（JSON形式のみ）
{"response":"日本語での応答メッセージ","tasks":[{"action":"add/update/delete/complete/uncomplete","title":"タスク名","due":"YYYY-MM-DD or null","existingTaskId":"既存タスク操作時のid"}]}

【重要】
- responseは必ず日本語で、フレンドリーに応答
- 普通の会話の場合はtasksを空配列[]にして、responseで会話
- 期限: 今日→${today}, 明日→${tomorrow}, 今週→${friday}, 指定なし→null
- 既存タスク操作時はexistingTaskIdを必ず含める
- 複数タスクがあれば複数抽出可能`;

  try {
    // Escape the prompt for shell
    const escapedPrompt = prompt.replace(/'/g, "'\\''");

    const output = execSync(
      `claude -p '${escapedPrompt}' --output-format text`,
      {
        encoding: 'utf-8',
        timeout: 60000,
        maxBuffer: 1024 * 1024,
        env: { ...process.env, HOME: process.env.HOME },
      }
    );

    // Helper to find listId for a task
    const findListId = (taskId: string): string | undefined => {
      const found = existingTasks?.find(t => t.id === taskId);
      return found?.listId;
    };

    // Helper to infer action from user message keywords
    const inferActionFromMessage = (msg: string, claudeAction: string): TaskAction => {
      const lowerMsg = msg.toLowerCase();
      if (lowerMsg.includes('完了') || lowerMsg.includes('終わった') || lowerMsg.includes('できた') || lowerMsg.includes('done')) {
        return 'complete';
      }
      if (lowerMsg.includes('削除') || lowerMsg.includes('消して') || lowerMsg.includes('いらない') || lowerMsg.includes('やめる')) {
        return 'delete';
      }
      if (lowerMsg.includes('未完了') || lowerMsg.includes('やっぱりまだ')) {
        return 'uncomplete';
      }
      // Otherwise trust Claude's action
      const validActions: TaskAction[] = ['add', 'update', 'delete', 'complete', 'uncomplete'];
      return validActions.includes(claudeAction as TaskAction) ? (claudeAction as TaskAction) : 'add';
    };

    console.log('Claude output:', output);

    // Extract JSON from output (may be wrapped in markdown code block)
    const jsonMatch = output.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);

      const tasks: ExtractedTask[] = (parsed.tasks || []).map((t: any) => ({
        id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        title: t.title,
        due: t.due || undefined,
        notes: t.notes || undefined,
        action: inferActionFromMessage(userMessage, t.action),
        existingTaskId: t.existingTaskId || undefined,
        existingListId: t.existingTaskId ? findListId(t.existingTaskId) : undefined,
      }));

      return {
        response: parsed.response || formatTaskResponse(tasks),
        tasks,
      };
    }

    // Try to parse as array directly
    const arrayMatch = output.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      const parsed = JSON.parse(arrayMatch[0]);
      const tasks: ExtractedTask[] = parsed.map((t: any) => ({
        id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        title: t.title,
        due: t.due || undefined,
        action: inferActionFromMessage(userMessage, t.action),
        existingTaskId: t.existingTaskId || undefined,
        existingListId: t.existingTaskId ? findListId(t.existingTaskId) : undefined,
      }));

      return {
        response: formatTaskResponse(tasks),
        tasks,
      };
    }

    return {
      response: 'タスクを抽出できませんでした。もう少し具体的に教えてください。',
      tasks: [],
    };
  } catch (err) {
    console.error('Claude CLI error:', err);
    return {
      response: 'AIとの通信でエラーが発生しました。',
      tasks: [],
    };
  }
}

function formatTaskResponse(tasks: ExtractedTask[]): string {
  if (tasks.length === 0) {
    return 'お手伝いできることがあれば教えてください！';
  }

  const grouped: Record<TaskAction, ExtractedTask[]> = {
    add: tasks.filter(t => t.action === 'add'),
    update: tasks.filter(t => t.action === 'update'),
    delete: tasks.filter(t => t.action === 'delete'),
    complete: tasks.filter(t => t.action === 'complete'),
    uncomplete: tasks.filter(t => t.action === 'uncomplete'),
  };

  const labels: Record<TaskAction, string> = {
    add: '追加',
    update: '更新',
    delete: '削除',
    complete: '完了',
    uncomplete: '未完了に戻す',
  };

  let response = '';

  for (const [action, items] of Object.entries(grouped)) {
    if (items.length > 0) {
      if (response) response += '\n';
      response += `【${labels[action as TaskAction]}】\n`;
      items.forEach((t, i) => {
        response += `${i + 1}. ${t.title}${t.due ? ` (期限: ${t.due})` : ''}\n`;
      });
    }
  }

  response += '\n実行しますか？';
  return response;
}
