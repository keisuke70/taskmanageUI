import { Router, type Request, type Response } from 'express';
import { extractTasksWithClaude, type ExistingTask, type ExtractedTask } from '../services/claude';
import { getTasks, getTaskLists, createTask, updateTask, deleteTask, completeTask, uncompleteTask } from '../services/gog';

const router = Router();

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

// Store conversation history per session
const conversations = new Map<string, ConversationMessage[]>();

// Chat endpoint using Claude Code for task extraction
router.post('/chat', async (req: Request, res: Response) => {
  const { message, sessionId = 'default', localDate } = req.body;

  if (!message) {
    res.status(400).json({ message: 'Message is required' });
    return;
  }

  // Get or create conversation
  if (!conversations.has(sessionId)) {
    conversations.set(sessionId, []);
  }
  const history = conversations.get(sessionId)!;

  // Add user message to history
  history.push({ role: 'user', content: message });

  try {
    // Build conversation context for Claude
    const recentContext = history
      .slice(-6)
      .map((m) => `${m.role === 'user' ? 'ユーザー' : 'AI'}: ${m.content}`)
      .join('\n');

    // Fetch existing tasks for context
    let existingTasks: ExistingTask[] = [];
    try {
      const listsResult = await getTaskLists();
      if (listsResult.success && listsResult.data) {
        for (const list of listsResult.data) {
          const tasksResult = await getTasks(list.id);
          if (tasksResult.success && tasksResult.data) {
            existingTasks.push(...tasksResult.data
              .filter(t => t.status === 'needsAction')  // 未完了タスクのみ
              .map(t => ({
                id: t.id,
                title: t.title,
                due: t.due,
                notes: t.notes,
                listId: list.id,
              }))
            );
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch existing tasks:', err);
      // Continue without existing tasks
    }

    console.log('existingTasks:', existingTasks.map(t => ({ id: t.id, title: t.title })));

    // Use Claude Code for intelligent extraction (pass client's local date)
    const result = await extractTasksWithClaude(message, recentContext, localDate, existingTasks);

    console.log('extractedTasks:', result.tasks);

    // Execute tasks immediately
    const executedTasks: { task: ExtractedTask; success: boolean; error?: string }[] = [];
    for (const task of result.tasks) {
      try {
        if (task.existingTaskId && task.existingListId) {
          // 既存タスクへの操作
          switch (task.action) {
            case 'update':
              await updateTask(task.existingTaskId, { title: task.title, due: task.due, notes: task.notes }, task.existingListId);
              break;
            case 'delete':
              await deleteTask(task.existingTaskId, task.existingListId);
              break;
            case 'complete':
              await completeTask(task.existingTaskId, task.existingListId);
              break;
            case 'uncomplete':
              await uncompleteTask(task.existingTaskId, task.existingListId);
              break;
            default:
              // add - 新規タスクとして追加
              await createTask(task.title, { due: task.due, notes: task.notes });
          }
        } else if (task.action === 'add') {
          // 新規タスク追加
          await createTask(task.title, { due: task.due, notes: task.notes });
        }
        executedTasks.push({ task, success: true });
      } catch (err) {
        console.error('Failed to execute task:', task, err);
        executedTasks.push({ task, success: false, error: err instanceof Error ? err.message : 'Unknown error' });
      }
    }

    console.log('executedTasks:', executedTasks);

    // Add assistant response to history
    history.push({ role: 'assistant', content: result.response });

    // Keep only last 20 messages
    if (history.length > 20) {
      history.splice(0, history.length - 20);
    }

    res.json({
      response: result.response,
      executedTasks,  // 実行済みタスクを返す（確認用）
    });
  } catch (err) {
    console.error('AI chat error:', err);
    res.status(500).json({
      message: 'AI processing failed',
      response: 'エラーが発生しました。もう一度試してください。',
      extractedTasks: [],
    });
  }
});

// Clear conversation
router.post('/clear', async (req: Request, res: Response) => {
  const { sessionId = 'default' } = req.body;
  conversations.delete(sessionId);
  res.json({ success: true });
});

export default router;
