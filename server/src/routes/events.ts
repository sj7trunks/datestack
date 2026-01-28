import { Router, Response } from 'express';
import { query, queryOne, run, Event, CalendarSource, getDb, saveDatabase } from '../database';
import { AuthRequest, requireAuth, requireApiKey } from '../middleware/auth';

const router = Router();

interface EventWithSource extends Event {
  source_name: string;
  source_color: string;
}

// GET /api/events - List events
router.get('/', requireAuth, (req: AuthRequest, res: Response) => {
  const { start, end, source } = req.query;

  let sql = `
    SELECT e.*, cs.name as source_name,
      COALESCE(cc.color, cs.color) as source_color
    FROM events e
    JOIN calendar_sources cs ON e.source_id = cs.id
    LEFT JOIN calendar_colors cc ON cc.user_id = cs.user_id AND cc.calendar_name = e.calendar_name
    WHERE cs.user_id = ?
  `;
  const params: any[] = [req.user!.id];

  if (start) {
    sql += ' AND e.start_time >= ?';
    params.push(start);
  }

  if (end) {
    sql += ' AND e.start_time <= ?';
    params.push(end);
  }

  if (source) {
    sql += ' AND e.source_id = ?';
    params.push(parseInt(source as string, 10));
  }

  sql += ' ORDER BY e.start_time ASC';

  try {
    const events = query<EventWithSource>(sql, params);
    res.json(events);
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// POST /api/events/sync - Bulk sync events from client
router.post('/sync', requireApiKey, (req: AuthRequest, res: Response) => {
  const { source_name, events } = req.body;

  if (!source_name || !events || !Array.isArray(events)) {
    return res.status(400).json({ error: 'source_name and events array are required' });
  }

  try {
    // Get or create the calendar source
    let source = queryOne<CalendarSource>(
      'SELECT * FROM calendar_sources WHERE user_id = ? AND name = ?',
      [req.user!.id, source_name]
    );

    if (!source) {
      const result = run(
        'INSERT INTO calendar_sources (user_id, name) VALUES (?, ?)',
        [req.user!.id, source_name]
      );
      source = queryOne<CalendarSource>('SELECT * FROM calendar_sources WHERE id = ?', [result.lastInsertRowid])!;
    }

    // Calculate the date range for cleanup (14 days from now)
    const now = new Date();
    const futureDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const endOfRange = futureDate.toISOString();

    const db = getDb();

    // Delete existing events in the sync range for this source
    run(
      'DELETE FROM events WHERE source_id = ? AND start_time >= ? AND start_time <= ?',
      [source.id, startOfToday, endOfRange]
    );

    // Insert new events
    let inserted = 0;
    for (const event of events) {
      if (!event.title || !event.start_time) {
        continue; // Skip invalid events
      }

      run(
        `INSERT INTO events (source_id, external_id, title, start_time, end_time, location, notes, all_day, calendar_name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          source.id,
          event.external_id || null,
          event.title,
          event.start_time,
          event.end_time || null,
          event.location || null,
          event.notes || null,
          event.all_day ? 1 : 0,
          event.calendar_name || null
        ]
      );
      inserted++;
    }

    // Auto-assign colors for new calendar_names
    const palette = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#6366F1'];
    const distinctCalendars = [...new Set(events.map((e: any) => e.calendar_name).filter(Boolean))];
    for (const calName of distinctCalendars) {
      const existing = queryOne('SELECT id FROM calendar_colors WHERE user_id = ? AND calendar_name = ?', [req.user!.id, calName]);
      if (!existing) {
        const countResult = query<{ cnt: number }>('SELECT COUNT(*) as cnt FROM calendar_colors WHERE user_id = ?', [req.user!.id]);
        const idx = (countResult[0]?.cnt || 0) % palette.length;
        run('INSERT INTO calendar_colors (user_id, calendar_name, color) VALUES (?, ?, ?)', [req.user!.id, calName, palette[idx]]);
      }
    }

    // Update last_sync timestamp
    run('UPDATE calendar_sources SET last_sync = datetime("now") WHERE id = ?', [source.id]);

    res.json({
      message: 'Sync complete',
      source_id: source.id,
      events_synced: inserted,
    });
  } catch (error) {
    console.error('Sync events error:', error);
    res.status(500).json({ error: 'Failed to sync events' });
  }
});

// GET /api/events/:id - Get single event
router.get('/:id', requireAuth, (req: AuthRequest, res: Response) => {
  const eventId = parseInt(req.params.id, 10);

  if (isNaN(eventId)) {
    return res.status(400).json({ error: 'Invalid event ID' });
  }

  const event = queryOne<EventWithSource>(`
    SELECT e.*, cs.name as source_name, cs.color as source_color
    FROM events e
    JOIN calendar_sources cs ON e.source_id = cs.id
    WHERE e.id = ? AND cs.user_id = ?
  `, [eventId, req.user!.id]);

  if (!event) {
    return res.status(404).json({ error: 'Event not found' });
  }

  res.json(event);
});

export default router;
