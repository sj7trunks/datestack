import { Router, Response } from 'express';
import { query, queryOne, run } from '../database';
import { AuthRequest, requireAuth } from '../middleware/auth';

const router = Router();

interface CalendarColor {
  id: number;
  user_id: number;
  calendar_name: string;
  color: string;
}

// GET /api/calendar-colors - List calendar colors for calendars that have events
router.get('/', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    // Only return calendars that have at least one event
    const colors = query<CalendarColor>(
      `SELECT DISTINCT cc.* FROM calendar_colors cc
       INNER JOIN events e ON e.calendar_name = cc.calendar_name
       INNER JOIN calendar_sources cs ON e.source_id = cs.id AND cs.user_id = cc.user_id
       WHERE cc.user_id = ?
       ORDER BY cc.calendar_name ASC`,
      [req.user!.id]
    );
    res.json(colors);
  } catch (error) {
    console.error('Get calendar colors error:', error);
    res.status(500).json({ error: 'Failed to fetch calendar colors' });
  }
});

// PATCH /api/calendar-colors/:name - Set color for a calendar_name
router.patch('/:name', requireAuth, (req: AuthRequest, res: Response) => {
  const calendarName = decodeURIComponent(req.params.name);
  const { color } = req.body;

  if (!color) {
    return res.status(400).json({ error: 'Color is required' });
  }

  try {
    // Upsert
    const existing = queryOne<CalendarColor>(
      'SELECT * FROM calendar_colors WHERE user_id = ? AND calendar_name = ?',
      [req.user!.id, calendarName]
    );

    if (existing) {
      run('UPDATE calendar_colors SET color = ? WHERE id = ?', [color, existing.id]);
    } else {
      run(
        'INSERT INTO calendar_colors (user_id, calendar_name, color) VALUES (?, ?, ?)',
        [req.user!.id, calendarName, color]
      );
    }

    const updated = queryOne<CalendarColor>(
      'SELECT * FROM calendar_colors WHERE user_id = ? AND calendar_name = ?',
      [req.user!.id, calendarName]
    );
    res.json(updated);
  } catch (error) {
    console.error('Update calendar color error:', error);
    res.status(500).json({ error: 'Failed to update calendar color' });
  }
});

export default router;
