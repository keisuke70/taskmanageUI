import { Router, Request, Response } from 'express';
import * as gog from '../services/gog';

const router = Router();

// Get all task lists
router.get('/lists', async (_req: Request, res: Response) => {
  const result = await gog.getTaskLists();
  if (!result.success) {
    res.status(500).json({ message: result.error });
    return;
  }
  res.json(result.data || []);
});

// Create a new task list
router.post('/lists', async (req: Request, res: Response) => {
  const { title } = req.body;
  if (!title) {
    res.status(400).json({ message: 'Title is required' });
    return;
  }
  const result = await gog.createTaskList(title);
  if (!result.success) {
    res.status(500).json({ message: result.error });
    return;
  }
  res.status(201).json(result.data);
});

// Delete a task list
router.delete('/lists/:listId', async (req: Request, res: Response) => {
  const { listId } = req.params;
  const result = await gog.deleteTaskList(listId);
  if (!result.success) {
    res.status(500).json({ message: result.error });
    return;
  }
  res.status(204).send();
});

// Get all tasks
router.get('/', async (req: Request, res: Response) => {
  const listId = req.query.listId as string | undefined;
  const result = await gog.getTasks(listId);
  if (!result.success) {
    res.status(500).json({ message: result.error });
    return;
  }
  res.json(result.data || []);
});

// Create a new task
router.post('/', async (req: Request, res: Response) => {
  const { title, notes, due, listId } = req.body;
  if (!title) {
    res.status(400).json({ message: 'Title is required' });
    return;
  }
  const result = await gog.createTask(title, { notes, due, listId });
  if (!result.success) {
    res.status(500).json({ message: result.error });
    return;
  }
  res.status(201).json(result.data);
});

// Update a task
router.patch('/:taskId', async (req: Request, res: Response) => {
  const { taskId } = req.params;
  const { title, notes, due, status, listId } = req.body;

  // Handle status changes with complete/uncomplete commands
  if (status === 'completed') {
    const result = await gog.completeTask(taskId, listId);
    if (!result.success) {
      res.status(500).json({ message: result.error });
      return;
    }
    res.json(result.data);
    return;
  }

  if (status === 'needsAction') {
    const result = await gog.uncompleteTask(taskId, listId);
    if (!result.success) {
      res.status(500).json({ message: result.error });
      return;
    }
    res.json(result.data);
    return;
  }

  // Regular updates
  const result = await gog.updateTask(taskId, { title, notes, due }, listId);
  if (!result.success) {
    res.status(500).json({ message: result.error });
    return;
  }
  res.json(result.data);
});

// Delete a task
router.delete('/:taskId', async (req: Request, res: Response) => {
  const { taskId } = req.params;
  const listId = req.query.listId as string | undefined;
  const result = await gog.deleteTask(taskId, listId);
  if (!result.success) {
    res.status(500).json({ message: result.error });
    return;
  }
  res.status(204).send();
});

export default router;
