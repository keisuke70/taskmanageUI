import { Router, Request, Response } from 'express';
import * as gog from '../services/gog';

const router = Router();

// Get calendar events
router.get('/', async (req: Request, res: Response) => {
  const start = req.query.start as string | undefined;
  const end = req.query.end as string | undefined;
  const result = await gog.getCalendarEvents(start, end);
  if (!result.success) {
    res.status(500).json({ message: result.error });
    return;
  }
  res.json(result.data || []);
});

// Create calendar event
router.post('/', async (req: Request, res: Response) => {
  const { title, start, end, calendarId } = req.body;
  if (!title || !start || !end) {
    res.status(400).json({ message: 'title, start, and end are required' });
    return;
  }
  const result = await gog.createCalendarEvent(title, start, end, calendarId);
  if (!result.success) {
    res.status(500).json({ message: result.error });
    return;
  }
  res.status(201).json(result.data);
});

// Update calendar event
router.patch('/:eventId', async (req: Request, res: Response) => {
  const { eventId } = req.params;
  const { start, end, summary, calendarId } = req.body;
  const result = await gog.updateCalendarEvent(eventId, { start, end, summary }, calendarId);
  if (!result.success) {
    res.status(500).json({ message: result.error });
    return;
  }
  res.json(result.data);
});

export default router;
