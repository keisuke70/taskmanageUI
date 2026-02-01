import { Router, type Request, type Response } from 'express';
import { analyzeEmails, analyzeCalendar, analyzeBoth } from '../services/suggestions';

const router = Router();

// Analyze emails and calendar for task suggestions
router.post('/analyze', async (req: Request, res: Response) => {
  try {
    const { source, localDate } = req.body;

    if (source === 'gmail') {
      const suggestions = await analyzeEmails(localDate);
      res.json({ success: true, suggestions });
    } else if (source === 'calendar') {
      const suggestions = await analyzeCalendar(localDate);
      res.json({ success: true, suggestions });
    } else {
      // Analyze both
      const result = await analyzeBoth(localDate);
      res.json({
        success: true,
        suggestions: [...result.gmail, ...result.calendar],
        gmail: result.gmail,
        calendar: result.calendar,
      });
    }
  } catch (err) {
    console.error('Analyze error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Analysis failed',
    });
  }
});

export default router;
